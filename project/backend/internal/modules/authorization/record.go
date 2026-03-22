package authorization

import "github.com/google/uuid"

type AccountBookPermissionRecord struct {
	AccountBookID uuid.UUID
	UserID        uuid.UUID
	AccountRole   string
}
