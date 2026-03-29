# Use Nginx Alpine for a tiny, high-performance container
FROM nginx:alpine

# Copy all project files into the Nginx public folder
COPY . /usr/share/nginx/html

# Expose port 80 for traffic
EXPOSE 80

# Nginx starts automatically by default
