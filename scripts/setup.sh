#!/bin/bash

# ollama
curl -fsSL https://ollama.com/install.sh | sh
ollama pull llama3.2:3b


# Bun Project
bun init -y;

bun add langchain @langchain/core @langchain/textsplitters 
bun add  @langchain/community @langchain/ollama
bun add vectordb @lancedb/lancedb
bun add pdf-parse
bun add -d @types/node @types/pdf-parse

mkdir -p src/{models,embeddings,vectorstores,chains,parsers}
mkdir data
mkdir chroma_db

