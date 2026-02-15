# 贡献指南

首先，感谢你对 Karotte oder Nein 的贡献！

## 开发

使用 [Bun](https://bun.com) 作为构建工具：

```bash
bun install
bun run dev
```

## 数据构建

项目使用本地 `raw-data/lemma_keys.all.tsv`（词频顺序）和 Kaikki 的 `de-extract.jsonl`（词性 source-of-truth）生成前 10000 个名词数据。

1. [注册账号并同意协议](https://www.ids-mannheim.de/cosmas2/projekt/registrierung/)，下载 [DeReKoGram](https://www.owid.de/plus/derekogram/data/) 中的：
    - `lemma_keys.all.tsv`

2. 从 Kaikki 下载德语词典抽取文件并放到 `raw-data/de-extract.jsonl`

    ```bash
    # 可直接从 https://kaikki.org/dictionary/rawdata.html 下载
    ```

3. 生成数据库

    ```bash
    bun run data:build
    ```

生成结果：

- `app/assets/data.sqlite`
- `app/assets/data.meta.txt`
