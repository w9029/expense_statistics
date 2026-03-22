package mail

import "context"

type Message struct {
	To      string
	Subject string
	Body    string
}

type Sender interface {
	Send(context.Context, Message) error
}

type NoopSender struct{}

func NewNoopSender() *NoopSender {
	return &NoopSender{}
}

func (s *NoopSender) Send(_ context.Context, _ Message) error {
	return nil
}
