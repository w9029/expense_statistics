CREATE TABLE notifications (
id uuid NOT NULL DEFAULT gen_random_uuid(),
user_id uuid NOT NULL,
type varchar(30) NOT NULL,
title text NOT NULL,
message text,
status varchar(10) NOT NULL DEFAULT "unread",
created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (id)
);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_status ON notifications(status);
