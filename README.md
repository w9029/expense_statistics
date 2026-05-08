# expense_statistics
A website to calculate and show the statistics of users' expenses

# Execute:
1. Run the backend server:
   - Open a terminal and navigate to the `project/backend` directory.
   - Check the `config.prod.yaml` file in the `internal/platform/config` directory to ensure the settings are correct.
   - Run the command: `.\build_backend_server.bat` in `project/backend`.

2. Run the frontend server:
    - Open another terminal and navigate to the `project/frontend` directory.
    - Run the command: `.\build_frontend_server.bat` in `project/frontend`.
    
# Build:
1. Build the backend server:
   - Open a terminal and navigate to the `project/backend` directory.
   - Run the command: `.\build_backend_server.bat` in `project/backend`.
   - This will create a `project/backend/release` directory with the built backend server.

2. Build the frontend server:
   - Open a terminal and navigate to the `project/frontend` directory.
   - Run the command: `.\build_frontend_server.bat` in `project/frontend`.
   - This will create a `project/frontend/apps/web/dist` directory with the built frontend server.


# Deploy:

1. Deploy the backend server:
   - Copy the contents of the `project/backend/release` directory to your production server.
   - Ensure that the `config.prod.yaml` file is correctly configured on the production server.
   - Run `./server -config internal/platform/config/config.prod.yaml` to start the backend server.

2. Deploy the frontend server:
    - Copy the contents of the `project/frontend/apps/web/dist` directory to your production server.
    - Serve the static files using a web server like Nginx or Apache.
    - As a sample, the configuration file of your Nginx should be like this:
    ```
    server {

        root /var/www/{your_frontend_directory};	

        # Add index.php to the list if you are using PHP
        index index.html index.htm index.nginx-debian.html;

        server_name {your_domain_name};
        
        location /api/ {
            proxy_pass http://127.0.0.1:8090;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        location = /healthz {
            proxy_pass http://127.0.0.1:8090/healthz;
        }

        location = /readyz {
            proxy_pass http://127.0.0.1:8090/readyz;
        }

        location / {
            try_files $uri /index.html;
        }

        listen 443 ssl http2; 
        ssl_certificate {your_certificate_path}; 
        ssl_certificate_key {your_certificate_key_path}; 
        include /etc/letsencrypt/options-ssl-nginx.conf; 
        ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem; 
    }

    server {
        
        if ($host = {your_domain_name}) {
            return 301 https://$host$request_uri;
        } 

        #root /var/www/fincalc;
        root /var/www/{your_frontend_directory};	
        
        index index.html index.htm index.nginx-debian.html;

        server_name {your_domain_name};
        
        listen 80;
        #listen [::]:80 default_server;

        return 404;
    }
      ```