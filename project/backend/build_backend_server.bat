rm -r .\release
mkdir release\internal\platform\config
go build -o .\release\server .\cmd\server\
copy .\internal\platform\config\config.prod.yaml .\release\internal\platform\config\