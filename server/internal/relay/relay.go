package relay

import (
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"sync"
	"time"

	"sparkyard/internal/db"
	"sparkyard/internal/ratelimit"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  4096,
	WriteBufferSize: 4096,
	CheckOrigin:     func(r *http.Request) bool { return true },
}

type Relay struct {
	pool     *db.Pool
	clients  sync.Map
	subMutex sync.RWMutex
	subs     map[string]*Subscription
	limiter  *ratelimit.Limiter
}

type Client struct {
	ws     *websocket.Conn
	relay  *Relay
	subIds map[string]bool
	mu     sync.Mutex
}

type Subscription struct {
	id      string
	filters []map[string]interface{}
	client  *Client
}

func New(pool *db.Pool) *Relay {
	return &Relay{
		pool:    pool,
		subs:    make(map[string]*Subscription),
		limiter: ratelimit.New(10, 20),
	}
}

func clientIP(req *http.Request) string {
	host, _, err := net.SplitHostPort(req.RemoteAddr)
	if err != nil {
		return req.RemoteAddr
	}
	return host
}

func (r *Relay) ServeHTTP(w http.ResponseWriter, req *http.Request) {
	if req.URL.Path == "/health" {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"status":"ok"}`))
		return
	}

	if !r.limiter.Allow(clientIP(req)) {
		http.Error(w, "rate limited", http.StatusTooManyRequests)
		return
	}

	ws, err := upgrader.Upgrade(w, req, nil)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	defer ws.Close()

	client := &Client{ws: ws, relay: r, subIds: make(map[string]bool)}
	r.clients.Store(ws, client)
	defer func() {
		r.clients.Delete(ws)
		client.mu.Lock()
		for sid := range client.subIds {
			r.subMutex.Lock()
			delete(r.subs, sid)
			r.subMutex.Unlock()
		}
		client.mu.Unlock()
	}()

	ws.SetReadLimit(1024 * 256)
	ws.SetReadDeadline(time.Now().Add(60 * time.Second))
	ws.SetPongHandler(func(string) error {
		ws.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	done := make(chan struct{})
	go r.pingLoop(ws, done)

	for {
		_, message, err := ws.ReadMessage()
		if err != nil {
			close(done)
			break
		}
		var msg []interface{}
		if err := json.Unmarshal(message, &msg); err != nil {
			r.sendNotice(client, fmt.Sprintf("invalid JSON: %v", err))
			continue
		}
		if len(msg) == 0 {
			continue
		}
		switch msg[0] {
		case "EVENT":
			r.handleEvent(client, msg)
		case "REQ":
			r.handleReq(client, msg)
		case "CLOSE":
			r.handleClose(client, msg)
		default:
			r.sendNotice(client, fmt.Sprintf("unknown message type: %v", msg[0]))
		}
	}
}

func (r *Relay) pingLoop(ws *websocket.Conn, done <-chan struct{}) {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-ticker.C:
			if err := ws.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		case <-done:
			return
		}
	}
}
