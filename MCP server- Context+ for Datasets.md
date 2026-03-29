# 🚀 PROJECT SPECIFICATION: "Context+ for Data" (Code Name: SchemaSense MCP)

## 📌 1. The Core Problem ("The Open Wound")
AI coding agents (Claude Code, Cursor, Gemini CLI) are exceptionally good at writing Python scripts for Machine Learning and Quantitative Analysis. However, they suffer from "Data Blindness." 
When an agent attempts to write feature engineering or debugging code for a local dataset (CSV, Parquet, SQL), it must either:
1. Guess the structure (leading to `KeyError`, `ValueError`, or shape mismatches).
2. Ask the user to paste the data (consuming massive token limits, ballooning API costs, and causing context degradation/hallucinations).

## 🎯 2. The Solution
SchemaSense is an MCP (Model Context Protocol) Server that acts as a "Diagnostic Bridge" between the AI agent and the developer's local datasets. 
Instead of sending raw data rows to the LLM, the MCP server uses local Pandas/NumPy engines to compute a highly compressed "Structural Mind Map" of the dataset. The AI queries the MCP, and the MCP returns only the statistical metadata required to write perfect code.

## ⚙️ 3. Core Architecture & Workflow
* **The Agent (LLM):** Needs to write a training loop or fix a data pipeline.
* **The MCP Server (SchemaSense):** Runs locally on the developer's machine.
* **The Workflow:**
  1. AI calls the MCP tool: `inspect_dataset(path="data/xauusd_1min.csv")`
  2. MCP loads the data locally via Pandas/Polars.
  3. MCP generates a JSON "Profile" (dtypes, null counts, memory, anomalies).
  4. AI receives the profile (consuming ~500 tokens instead of 50,000) and writes flawless Python code.

## 🛠️ 4. Key Features & MCP Tools to Build
The server will expose the following specific tools to the AI agent:

* **`get_schema_map`**: Returns column names, data types (int64, float32, object), and dataframe shape. Prevents type-mismatch errors.
* **`get_null_distribution`**: Scans the dataset and returns exact indices or percentages of `NaN` or missing values. Allows the AI to instantly write the correct `.fillna()` or `.dropna()` logic.
* **`get_statistical_profile`**: Returns a lightweight description (Min, Max, Mean, Std Dev) for numeric columns. Crucial for scaling/normalizing data (e.g., MinMax or Z-score generation).
* **`detect_anomalies`**: Scans numeric columns for string contamination (e.g., finding the word "Error" inside a float column) or extreme outliers without the AI needing to read the rows.
* **`get_semantic_sample`**: Instead of reading the whole file, returns exactly 5 representative rows formatted beautifully so the AI can understand the "look" of the data.

## 💻 5. Recommended Tech Stack
* **Language:** Python (Essential for native integration with ML data tools).
* **Protocol:** Official Anthropic/Google MCP Python SDK.
* **Data Engines:** `Pandas` (for standard data), `Polars` (for ultra-fast large dataset scanning), `PyArrow` (for Parquet files).
* **Delivery:** JSON-formatted responses optimized for LLM context windows.

## 📈 6. The "CV Flex" / Value Proposition
* **Solves Real-World API Costs:** Demonstrates a deep understanding of LLM token economics by actively preventing "context bloat."
* **Advanced Architecture:** Shows recruiters you understand how to build asynchronous, multi-agent developer tools, not just standard ML models.
* **High Open-Source Viability:** Every Data Scientist and Quant Developer using an AI coding assistant will want this installed globally on their machine.