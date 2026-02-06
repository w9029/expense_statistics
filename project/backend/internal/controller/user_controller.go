package controller

import (
    "net/http"

    "expense-statistics-server/internal/model"
    "expense-statistics-server/internal/service"

    "github.com/gin-gonic/gin"
)
type UserController struct {
    service *service.UserService
}

func NewUserController(service *service.UserService) *UserController {
    return &UserController{service: service}
}

func (uc *UserController) Register(c *gin.Context) {
    var user model.User
    if err := c.ShouldBindJSON(&user); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }

    if err := uc.service.RegisterUser(&user); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }

    c.JSON(http.StatusOK, gin.H{"message": "user created", "user_id": user.ID})
}

func (uc *UserController) GetUserByID(c *gin.Context) {
    id := c.Param("id")
    user, err := uc.service.GetUserByID(id) 
    if err != nil {
        c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
        return
    }
    c.JSON(http.StatusOK, user)
}
