package service

import (
    "expense-statistics-server/internal/model"
    "expense-statistics-server/internal/repository"
    "errors"
)

type UserService struct {
    repo *repository.UserRepository
}

func NewUserService(repo *repository.UserRepository) *UserService {
    return &UserService{repo: repo}
}

func (s *UserService) RegisterUser(user *model.User) error {
    // 这里可以加业务逻辑，比如邮箱是否存在
    existing, _ := s.repo.GetByEmail(user.Email)
    if existing != nil {
        return errors.New("email already registered")
    }

    return s.repo.Create(user)
}

func (s *UserService) GetUserByID(id string) (*model.User, error) {
    return s.repo.GetByID(id)
}
