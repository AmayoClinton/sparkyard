FROM golang:1.22-bookworm AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -o /out/relay ./cmd/relay

FROM debian:bookworm-slim
WORKDIR /app
COPY --from=build /out/relay /app/relay
EXPOSE 8081
ENTRYPOINT ["/app/relay"]