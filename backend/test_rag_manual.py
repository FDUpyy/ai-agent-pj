import os

from app.services.rag_service import RAGService


def main() -> None:
    service = RAGService()
    test_path = os.path.join(os.path.dirname(__file__), "test.txt")
    with open(test_path, "w", encoding="utf-8") as f:
        f.write("Trae 是一个很棒的 AI 编程工具。")
    service.ingest_file(test_path)
    results = service.query("Trae 是什么")
    print("Query: Trae 是什么")
    for index, doc in enumerate(results, start=1):
        print(f"Result {index}:")
        print(doc.page_content)
        print(doc.metadata)


if __name__ == "__main__":
    main()
