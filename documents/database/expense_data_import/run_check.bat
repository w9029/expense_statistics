@REM dev env
@REM python check_importdata.py --api-base-url "http://127.0.0.1:8080/api/v1" --lookback-days 0 --account-book-id 4e63ae61-2b5f-4e59-85a4-1e98541dd256 --email jiahua_www@outlook.com --password 145n987jmn

@REM prod env
python check_importdata.py --api-base-url "http://wlzy.online:8090/api/v1" --lookback-days 45 --account-book-id fae2c67d-5629-4d8e-83fd-57299cff4a5b --email jiahua_www@outlook.com --password 145n987jmn

