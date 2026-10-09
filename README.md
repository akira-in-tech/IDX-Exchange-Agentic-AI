# IDX-Exchange-Agentic-AI

AI Agentic Engineer internship project for IDX Exchange.

## Project Overview

This repository contains the code and documentation for an OpenClaw-based multi-agent AI assistant built around real estate MLS data.

The project will progressively support:

- Natural-language property search
- MySQL-backed MLS querying
- Market analytics
- Semantic search and embeddings
- Property recommendations
- Retrieval-augmented generation (RAG)
- Multi-agent orchestration
- WhatsApp and email integrations

## Week 0: Environment Setup

Initial setup includes:

- OpenClaw installation
- Python development environment
- Local MySQL database
- MLS dataset import
- Secure environment variables
- WhatsApp channel configuration
- End-to-end communication testing

## Week 1: Architecture Fundamentals

The OpenClaw system design, component responsibilities, session and memory boundaries, MLS database routing, and end-to-end WhatsApp workflow are documented in [docs/week-1-architecture.md](docs/week-1-architecture.md).

## Week 2: Natural-Language Property Search

The deterministic `parse_property_query` skill converts free-text property requests into structured MLS filters. See [docs/week-2-property-query-skill.md](docs/week-2-property-query-skill.md) for supported filters, field mappings, examples, and test instructions.

Run the 15-test validation suite with:

```bash
npm test
```

## Repository Structure

```text
src/        Application source code
docs/       Architecture and project documentation
scripts/    Utility and setup scripts
```

## Data and Security

MLS datasets are stored locally and are not committed to this repository.

The following are excluded from version control:

- SQL dumps
- CSV/raw datasets
- API keys
- `.env` files
- Database files
- Credentials
