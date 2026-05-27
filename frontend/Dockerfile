FROM nginx:1.27-alpine

COPY nginx/templates /etc/nginx/templates
COPY . /usr/share/nginx/html

RUN sed -i "s|http://localhost:8000/api|/api|g" /usr/share/nginx/html/LIMS_0-8-1.dev.html

EXPOSE 80
