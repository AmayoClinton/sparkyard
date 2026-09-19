package relay

import "time"

func (r *Relay) sendEvent(client *Client, subID string, event map[string]interface{}) {
	r.writeJSON(client, []interface{}{"EVENT", subID, event})
}

func (r *Relay) sendEOSE(client *Client, subID string) {
	r.writeJSON(client, []interface{}{"EOSE", subID})
}

func (r *Relay) sendOK(client *Client, eventID string, accepted bool, reason string) {
	r.writeJSON(client, []interface{}{"OK", eventID, accepted, reason})
}

func (r *Relay) sendNotice(client *Client, message string) {
	r.writeJSON(client, []interface{}{"NOTICE", message})
}

func (r *Relay) writeJSON(client *Client, v interface{}) {
	client.ws.SetWriteDeadline(time.Now().Add(10 * time.Second))
	client.ws.WriteJSON(v)
}
