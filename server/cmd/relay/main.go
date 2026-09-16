package main

import (
	"log"
	"net/http"
	"os"
	"time"

	"sparkyard/internal/db"
	"sparkyard/internal/relay"

	"github.com/joho/godotenv"
)

func main() {
	_ = godotenv.Load()

	pool, err := db.NewPool(os.Getenv("DATABASE_URL"))
	if err != nil {
		log.Fatalf("db connect: %v", err)
	}
	defer pool.Close()

	if err := migrateWithRetry(pool); err != nil {
		log.Fatalf("db migrate: %v", err)
	}

	r := relay.New(pool)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8081"
	}

	log.Printf("Sparkyard relay starting on :%s", port)
	if err := http.ListenAndServe(":"+port, r); err != nil {
		log.Fatalf("server: %v", err)
	}
}

func migrateWithRetry(pool *db.Pool) error {
	var err error
	for attempt := 1; attempt <= 30; attempt++ {
		if err = db.Migrate(pool); err == nil {
			return nil
		}
		log.Printf("db migrate attempt %d failed: %v", attempt, err)
		time.Sleep(2 * time.Second)
	}
	return err
}
