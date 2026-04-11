# Sử dụng Node.js bản chính thức
FROM node:20

# Cài đặt GCC bên trong Docker (có quyền root)
RUN apt-get update && apt-get install -y gcc g++

# Tạo thư mục app
WORKDIR /usr/src/app

# Copy package.json và cài đặt thư viện
COPY package*.json ./
RUN npm install

# Copy toàn bộ code vào
COPY . .

# Mở cổng 10000
EXPOSE 10000

# Chạy server
CMD ["node", "server.js"]