package mail

import (
	"context"
	"crypto/tls"
	"fmt"
	"net"
	"net/smtp"
	"strings"
	"time"

	"expense-statistics-server/internal/platform/config"
)

type Message struct {
	To      string
	Subject string
	Body    string
}
type Sender interface {
	Send(context.Context, Message) error
}
type NoopSender struct{}

type SMTPSender struct {
	from     string
	host     string
	port     int
	username string
	password string
}

// NewSender 根据配置创建一个SMTP邮件发送器，如果配置不完整则返回一个不会发送邮件的NoopSender。
// NoopSender用于测试，会直接成功返回，不会真的发送邮件。
func NewSender(cfg config.MailConfig) Sender {
	if cfg.Host == "" || cfg.Port == 0 || cfg.From == "" || cfg.Password == "" {
		return NewNoopSender()
	}
	username := strings.TrimSpace(cfg.Username)
	if username == "" {
		username = strings.TrimSpace(cfg.From)
	}
	return &SMTPSender{from: strings.TrimSpace(cfg.From), host: strings.TrimSpace(cfg.Host), port: cfg.Port, username: username, password: cfg.Password}
}

func NewNoopSender() *NoopSender                              { return &NoopSender{} }
func (s *NoopSender) Send(_ context.Context, _ Message) error { return nil }

func (s *SMTPSender) Send(ctx context.Context, msg Message) error {
	client, conn, err := s.dial(ctx)
	if err != nil {
		return err
	}
	defer conn.Close()
	defer client.Close()
	auth := smtp.PlainAuth("", s.username, s.password, s.host)
	if err := client.Auth(auth); err != nil {
		return fmt.Errorf("smtp auth failed: %w", err)
	}
	if err := client.Mail(s.from); err != nil {
		return fmt.Errorf("smtp mail from failed: %w", err)
	}
	if err := client.Rcpt(strings.TrimSpace(msg.To)); err != nil {
		return fmt.Errorf("smtp rcpt failed: %w", err)
	}
	writer, err := client.Data()
	if err != nil {
		return fmt.Errorf("smtp data failed: %w", err)
	}
	if _, err := writer.Write([]byte(buildMessage(s.from, msg))); err != nil {
		return fmt.Errorf("smtp write failed: %w", err)
	}
	if err := writer.Close(); err != nil {
		return fmt.Errorf("smtp close writer failed: %w", err)
	}
	if err := client.Quit(); err != nil {
		return fmt.Errorf("smtp quit failed: %w", err)
	}
	return nil
}

// 按端口号区分465和其他端口，465端口直接TLS连接，其他端口先普通连接再STARTTLS升级。支持上下文控制超时。
func (s *SMTPSender) dial(ctx context.Context) (*smtp.Client, net.Conn, error) {
	address := fmt.Sprintf("%s:%d", s.host, s.port)
	dialer := &net.Dialer{Timeout: 10 * time.Second}
	if s.port == 465 {
		conn, err := tls.DialWithDialer(dialer, "tcp", address, &tls.Config{ServerName: s.host})
		if err != nil {
			return nil, nil, fmt.Errorf("tls dial smtp: %w", err)
		}
		client, err := smtp.NewClient(conn, s.host)
		if err != nil {
			conn.Close()
			return nil, nil, fmt.Errorf("create smtp client: %w", err)
		}
		return client, conn, nil
	}
	conn, err := dialer.DialContext(ctx, "tcp", address)
	if err != nil {
		return nil, nil, fmt.Errorf("dial smtp: %w", err)
	}
	client, err := smtp.NewClient(conn, s.host)
	if err != nil {
		conn.Close()
		return nil, nil, fmt.Errorf("create smtp client: %w", err)
	}
	if ok, _ := client.Extension("STARTTLS"); ok {
		if err := client.StartTLS(&tls.Config{ServerName: s.host}); err != nil {
			client.Close()
			conn.Close()
			return nil, nil, fmt.Errorf("starttls failed: %w", err)
		}
	}
	return client, conn, nil
}

func buildMessage(from string, msg Message) string {
	return strings.Join([]string{fmt.Sprintf("From: %s", from), fmt.Sprintf("To: %s", strings.TrimSpace(msg.To)), fmt.Sprintf("Subject: %s", msg.Subject), "MIME-Version: 1.0", "Content-Type: text/plain; charset=UTF-8", "", msg.Body, ""}, "\r\n")
}
