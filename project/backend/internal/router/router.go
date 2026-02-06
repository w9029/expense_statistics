package router

import (
    "expense-statistics-server/internal/controller"
	"expense-statistics-server/internal/repository"
	"expense-statistics-server/internal/service"

    "github.com/gin-gonic/gin"
)

func SetupRouter() *gin.Engine {
    r := gin.Default()

	userRepo := repository.NewUserRepository()
    userService := service.NewUserService(userRepo)
    userController := controller.NewUserController(userService)

    users := r.Group("/users")
    {
        users.POST("/register", userController.Register)
        users.GET("/:id", userController.GetUserByID)
    }



    return r
}
