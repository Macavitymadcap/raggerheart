# Daggerheart RAG Assistant

A production-ready Retrieval-Augmented Generation (RAG) application for querying the Daggerheart TTRPG System Reference Document. Built with TypeScript, Bun, LangChain, Qdrant vector database, and Ollama for local LLM inference.

## 🌟 Features

- **🚀 Fast & Accurate**: Dual-model system (1b for speed, 3b for accuracy)
- **📚 Multi-Format Support**: Parses both PDF and Markdown documents with intelligent chunking
- **🎯 Smart Query Routing**: Automatically detects query complexity and selects appropriate model
- **💾 Production Vector Store**: Qdrant for high-performance similarity search
- **🔒 100% Local**: No API keys, no cloud services, complete privacy
- **🎨 Modern UI**: HTMX-powered interface with real-time streaming responses
- **📖 CLI Mode**: Interactive terminal interface for power users

## 📋 Table of Contents

- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [How It Works](#how-it-works)
- [Project Structure](#project-structure)
- [Performance](#performance)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)

## 🏗️ Architecture

```
User Query
    ↓
Query Type Detection (stat block / equipment / general)
    ↓
Model Selection (1b fast / 3b accurate)
    ↓
Vector Search (Qdrant) → Retrieve top-k chunks
    ↓
Context Building → Relevant chunks assembled
    ↓
Prompt Template → Query-specific prompt
    ↓
LLM Generation (Ollama) → Streaming response
    ↓
Answer + Sources
```

### Component Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Runtime** | Bun | Fast JavaScript/TypeScript runtime |
| **LLM** | Ollama (llama3.2:1b, llama3.2:3b) | Local language models |
| **Embeddings** | Ollama (nomic-embed-text) | Text → vector conversion |
| **Vector DB** | Qdrant (Docker/Podman) | Similarity search & storage |
| **Framework** | LangChain | RAG orchestration |
| **Web Server** | Hono | Lightweight HTTP framework |
| **Frontend** | HTMX + JSX | Server-side rendering |
| **Parsing** | pdf-parse, custom Markdown parser | Document processing |

## 📦 Prerequisites

- **Ubuntu 24.04** (or similar Linux distribution)
- **Bun** >= 1.3.1
- **Podman** or Docker
- **8GB+ RAM** (16GB recommended)
- **5GB+ disk space** for models

## 🚀 Installation

### Step 1: Install Bun

```bash
curl -fsSL https://bun.sh/install | bash
```

### Step 2: Install Podman

```bash
sudo apt-get update
sudo apt-get install -y podman
```

### Step 3: Install Ollama

```bash
# Download and install
curl -fsSL https://ollama.com/install.sh | sh

# Verify installation
ollama --version
```

### Step 4: Pull Ollama Models

```bash
# Pull language models
ollama pull llama3.2:1b    # Fast model (2GB)
ollama pull llama3.2:3b    # Accurate model (4GB)

# Pull embedding model
ollama pull nomic-embed-text

# Verify models
ollama list
```

### Step 5: Start Qdrant

```bash
# Create storage directory
mkdir -p ~/qdrant_storage

# Run Qdrant container
podman run -d \
  --name qdrant \
  -p 6333:6333 \
  -p 6334:6334 \
  -v ~/qdrant_storage:/qdrant/storage:z \
  docker.io/qdrant/qdrant

# Verify it's running
curl http://localhost:6333/
# Should return: {"title":"qdrant - vector search engine","version":"..."}
```

### Step 6: Clone and Setup Project

```bash
# Clone the repository
git clone <your-repo-url>
cd daggerheart-rag

# Install dependencies
bun install

# Add your documents to the data directory
mkdir -p data
# Copy PDFs or Markdown files into data/
cp /path/to/your/documents/*.pdf data/
cp /path/to/your/documents/*.md data/

# Initialize the vector database
bun run init

# Start the server
bun run dev
```

Open http://localhost:3000 in your browser.

## ⚙️ Configuration

Edit `src/rag/config.ts` to customize:

```typescript
export const defaultConfig: AppConfig = {
  // Fast model for simple queries (2-3x faster)
  fastModel: {
    provider: 'ollama',
    modelName: 'llama3.2:1b',
    temperature: 0.3,
    numCtx: 2048,
  },
  
  // Accurate model for complex queries
  accurateModel: {
    provider: 'ollama',
    modelName: 'llama3.2:3b',
    temperature: 0.3,
    numCtx: 4096,
  },
  
  // Embedding configuration
  embedding: {
    provider: 'ollama',
    modelName: 'nomic-embed-text',
  },
  
  // Vector store configuration
  vectorStore: {
    provider: 'qdrant',
    collectionName: 'daggerheart_rag',
    url: 'http://localhost:6333',
    onDisk: true,        // Store on disk to save RAM
    quantization: false, // Enable for lower RAM usage
    memmap: true,        // Memory-mapped files for efficiency
  },
  
  // Chunking strategy
  chunkSize: 800,       // Smaller = more precise retrieval
  chunkOverlap: 100,    // Overlap between chunks
};
```

## 🎮 Usage

### Web Interface

```bash
# Start the web server
bun run dev
```

Navigate to http://localhost:3000 and start asking questions!

**Example queries:**
- "What are Hope tokens used for?"
- "Show me the stat block for a zombie"
- "What are the stats for a longsword?"
- "How does the duality die work?"

### CLI Mode

```bash
# Start interactive CLI
bun run query
```

**CLI Commands:**
- `exit` - Quit the application
- `help` - Show help
- `k=N` - Set number of chunks to retrieve (e.g., `k=15`)

### Scripts

```bash
# Initialize/re-initialize the database
bun run init

# Run interactive queries
bun run query

# Start web server
bun run dev

# Clear vector database
bun run reset

# Podman management
bun run qdrant:start
bun run qdrant:stop
bun run qdrant:logs
```

## 🔬 How It Works

### 1. Document Parsing

The system supports **PDF** and **Markdown** documents:

**PDF Parsing:**
- Extracts text from each page
- Chunks by semantic boundaries (sections, paragraphs)
- Preserves page metadata

**Markdown Parsing (Recommended):**
- 20-50x faster than PDF
- Preserves document structure (headers, sections)
- Supports YAML frontmatter for metadata
- Better chunk quality

**Unified Parser:**
- Auto-detects file type by extension
- Processes mixed document collections
- Recursive directory scanning

### 2. Chunking Strategy

```typescript
// Optimized chunking
chunkSize: 800       // Smaller = more precise
chunkOverlap: 100    // Context preservation

// Separators for intelligent splitting
[
  '\n## ',      // Section headers
  '\n### ',     // Subsection headers
  '\nTier ',    // Stat blocks
  '\n\n',       // Paragraphs
  '\n',         // Lines
  ' ',          // Words
]
```

**Markdown sections** are kept intact when possible, preserving semantic coherence.

### 3. Embeddings

Each chunk is converted to a 768-dimensional vector using `nomic-embed-text`:

```
Text Chunk → Embedding Model → [0.23, -0.15, 0.87, ...]
```

Embeddings capture semantic meaning, enabling similarity search.

### 4. Vector Storage (Qdrant)

Vectors are stored in Qdrant with optimizations:

- **On-disk storage**: Saves RAM
- **Memory-mapped files**: Fast access
- **Cosine similarity**: Best for text embeddings
- **Payload indexes**: Fast metadata filtering

### 5. Query Processing

**Step 1: Query Type Detection**
```typescript
// Automatically detects query complexity
isStatBlockQuery = /stat\s*block|adversary|enemy|monster/
isWeaponQuery = /weapon|armor|equipment|gear/
isSimpleQuery = everything else
```

**Step 2: Model Selection**
- **Simple queries** → llama3.2:1b (fast)
- **Complex queries** → llama3.2:3b (accurate)

**Step 3: Dynamic Chunk Retrieval**
- Simple: k=4 chunks
- Equipment: k=8 chunks
- Stat blocks: k=10+ chunks

**Step 4: Context Assembly**
```
[Source 1: document.pdf, Page 42]
<chunk content>

---

[Source 2: guide.md, Section "Combat", Page 15]
<chunk content>
```

**Step 5: Prompt Template Selection**

Three specialized prompts:
- **Standard**: General questions
- **Equipment**: Weapon/armor tables
- **Stat Block**: Adversary extraction

**Step 6: LLM Generation**

Streams response in real-time with sources cited.

### 6. Response Formatting

**Equipment queries** → Formatted tables
**Stat blocks** → Formatted stat blocks
**General** → Natural paragraphs + lists

## 📁 Project Structure

```
daggerheart-rag/
├── src/
│   ├── cli/
│   │   ├── init.ts              # Database initialization
│   │   └── query.ts             # Interactive CLI
│   ├── rag/
│   │   ├── chains/
│   │   │   └── rag-chain.ts     # RAG orchestration
│   │   ├── config.ts            # App configuration
│   │   ├── embeddings/
│   │   │   └── embedding-factory.ts
│   │   ├── models/
│   │   │   └── model-factory.ts # LLM provider factory
│   │   ├── parsers/
│   │   │   ├── parser.interface.ts
│   │   │   ├── pdf-parser.ts
│   │   │   ├── markdown-parser.ts
│   │   │   └── unified-parser.ts
│   │   └── vectorstores/
│   │       ├── store.interface.ts
│   │       ├── qdrant-store.ts
│   │       ├── simple-store.ts  # In-memory fallback
│   │       └── vector-store-factory.ts
│   ├── ui/
│   │   ├── components.tsx       # JSX UI components
│   │   ├── formatters.tsx       # Response formatting
│   │   └── prompts.ts           # Prompt templates
│   └── server.tsx               # Hono web server
├── public/
│   ├── css/styles.css
│   ├── js/app.js
│   └── index.html
├── data/                        # Your documents go here
├── package.json
├── tsconfig.json
└── README.md
```

## ⚡ Performance

### Speed Comparison

| Query Type | Model | Chunks | Avg Time |
|-----------|-------|--------|----------|
| Simple | 1b | 4 | ~1.5s |
| Equipment | 3b | 8 | ~3.5s |
| Stat Block | 3b | 10 | ~4.5s |

### Resource Usage

| Component | RAM | Disk |
|-----------|-----|------|
| llama3.2:1b | ~2GB | ~1.5GB |
| llama3.2:3b | ~4GB | ~3.5GB |
| nomic-embed-text | ~500MB | ~274MB |
| Qdrant (10k chunks) | ~200MB | ~50MB |
| **Total** | **~7GB** | **~5.5GB** |

### Optimization Tips

**For 8GB RAM systems:**
```typescript
vectorStore: {
  onDisk: true,
  quantization: true,  // Enable quantization
  memmap: true,
}
```

**For faster queries:**
- Use smaller chunk retrieval (k=4)
- Increase chunk size (1000+ chars)
- Use markdown instead of PDF

**For better accuracy:**
- Increase chunk retrieval (k=10-15)
- Use 3b model for all queries
- Decrease chunk size (600-800 chars)

## 🐛 Troubleshooting

### Qdrant Connection Issues

```bash
# Check if Qdrant is running
podman ps | grep qdrant

# Restart Qdrant
podman restart qdrant

# Check logs
podman logs qdrant

# Test API
curl http://localhost:6333/
```

### Ollama Issues

```bash
# Check if Ollama is running
ollama list

# Restart Ollama service
sudo systemctl restart ollama

# Test model
ollama run llama3.2:1b "Hello"
```

### Memory Errors

If you run out of memory:

1. **Enable quantization** in config
2. **Use only 1b model** for all queries
3. **Reduce chunk retrieval** (k=3-4)
4. **Close other applications**

### Slow Queries

1. **Check Qdrant performance:**
   ```bash
   curl http://localhost:6333/collections/daggerheart_rag
   ```

2. **Reduce chunk size** in config
3. **Use fast model** for more queries
4. **Enable payload indexes:**
   ```typescript
   await vectorStore.createPayloadIndex('source');
   ```

### Database Initialization Fails

```bash
# Clear everything and start fresh
bun run reset
rm -rf data/
mkdir data/

# Add your documents
cp /path/to/docs/*.pdf data/

# Re-initialize
bun run init
```

### PDF Parsing Errors

Some PDFs may fail. Solutions:

1. **Convert to Markdown** (recommended)
2. **Try different PDF** if corrupted
3. **Check parser logs** for specific errors

### Port Already in Use

```bash
# Check what's using port 3000
lsof -i :3000

# Kill the process or change port in server.tsx
const port = 3001; // Change this
```

## 📊 Document Recommendations

### Best Practices

✅ **Use Markdown when possible:**
- 20-50x faster parsing
- Better structure preservation
- Perfect accuracy
- Smaller file sizes

✅ **Structure your documents:**
- Use clear headers (`##`, `###`)
- Add YAML frontmatter for metadata
- Keep sections focused

✅ **Organize by topic:**
```
data/
├── core-rules/
│   ├── combat.md
│   ├── character-creation.md
│   └── advancement.md
├── bestiary/
│   └── adversaries.md
└── equipment/
    └── weapons-armor.md
```

❌ **Avoid:**
- Scanned PDFs (poor OCR quality)
- Image-heavy documents (not searchable)
- Very large single files (split them up)

### Markdown Template

```markdown
---
title: "Combat Rules"
category: "core-rules"
version: "1.0"
tags: ["combat", "mechanics"]
---

# Combat Rules

## Initiative

How initiative works...

## Attacks

How attacks work...
```

## 📄 License

This project is provided as-is for educational and personal use.

## 🙏 Acknowledgments

- **Daggerheart** by Darrington Press
- **LangChain** for RAG framework
- **Ollama** for local LLM inference
- **Qdrant** for vector search
- **Bun** for blazing-fast runtime

---

**Built with ❤️ for the Daggerheart community**
