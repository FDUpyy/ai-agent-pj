import requests


def main() -> None:
    url = "http://127.0.0.1:8000/api/chat"
    message = "你好，简单介绍一下这个项目和 Trae 是什么。"
    with requests.post(url, json={"message": message}, stream=True) as response:
        response.raise_for_status()
        for chunk in response.iter_content(chunk_size=None):
            if not chunk:
                continue
            text = chunk.decode("utf-8", errors="ignore")
            print(text, end="", flush=True)


if __name__ == "__main__":
    main()
