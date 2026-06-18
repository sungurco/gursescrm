# ---------- Build stage ----------
FROM node:20-alpine AS build

WORKDIR /app

# Cache deps
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

# Build app
COPY . .
# Same-origin: leave REACT_APP_BACKEND_URL empty so app uses current host
ENV REACT_APP_BACKEND_URL=""
RUN yarn build

# ---------- Runtime stage ----------
FROM nginx:1.27-alpine

# Remove default config; add ours
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf

COPY --from=build /app/build /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
