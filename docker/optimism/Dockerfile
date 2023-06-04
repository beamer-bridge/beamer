FROM ubuntu:latest

SHELL ["/bin/bash", "-c"]

RUN apt update && apt install -y curl gnupg make jq
RUN install -m 0755 -d /etc/apt/keyrings && \
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg && \
    chmod a+r /etc/apt/keyrings/docker.gpg && \
    echo \
      "deb [arch="$(dpkg --print-architecture)" signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
      "$(. /etc/os-release && echo "$VERSION_CODENAME")" stable" | \
      tee /etc/apt/sources.list.d/docker.list > /dev/null
RUN apt update && apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose

RUN curl -L https://go.dev/dl/go1.20.2.linux-amd64.tar.gz --output go.tar.gz && \
    tar -xvf go.tar.gz && \
    mv go /root/.go
ENV GOROOT=/root/.go
ENV PATH=/root/.go/bin:$PATH
