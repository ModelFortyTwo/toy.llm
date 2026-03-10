# TOY Benchmark

This repo contains some toy benchmarks for testing performance of open source coding models.

## Live demos

The GitHub Actions Pages pipeline publishes a static index that discovers every `.html` example in the repo and groups links by folder structure.

- [Site index](https://modelfortytwo.github.io/toy.llm/)

## Repo tools

These are the helper tools and automation scripts currently used in this repository.

- [`scripts/build_pages.py`](scripts/build_pages.py): Scans the repo for publishable `.html` files, copies them into `dist/`, and generates the static GitHub Pages index.
- [`scripts/run_opencode_task.ps1`](scripts/run_opencode_task.ps1): Runs `opencode run` for a task/model pair, stores the full run log as `output.txt` in the model folder, and appends benchmark metrics to the top-level `benchmark_runs.csv`.
- [`scripts/render_benchmark_table.py`](scripts/render_benchmark_table.py): Renders `benchmark_runs.csv` into a standalone HTML table for comparing models by duration, tokens, and cost.
- [`.github/workflows/pages.yml`](.github/workflows/pages.yml): GitHub Actions workflow that runs `scripts/build_pages.py` and deploys the generated static site to GitHub Pages.

## Benchmark artifacts

- [`benchmark_runs.csv`](benchmark_runs.csv): Top-level CSV with one row per recorded `opencode` benchmark run.
- Model folder `output.txt`: Full raw execution log for a single run, stored inside that model's folder.
- Generated task HTML files such as `calculator.html` and `snake.html`: The benchmark outputs that are published on GitHub Pages.

## Tasks

### 001. HTML + js Calculator app

**Task** Implement Casio fx-82MS calculator using HTML and js to calculator.html.

- `gpt-5.1-codex-mini-high` page: [calculator](https://modelfortytwo.github.io/toy.llm/001/codex/gpt-5.1-codex-mini-high/calculator.html) html: [`001/codex/gpt-5.1-codex-mini-high/calculator.html`](001/codex/gpt-5.1-codex-mini-high/calculator.html)
- `gpt-5.2-codex-high` page: [calculator](https://modelfortytwo.github.io/toy.llm/001/codex/gpt-5.2-codex-high/calculator.html) html: [`001/codex/gpt-5.2-codex-high/calculator.html`](001/codex/gpt-5.2-codex-high/calculator.html)
- `gpt-5.3-codex-high` page: [calculator](https://modelfortytwo.github.io/toy.llm/001/codex/gpt-5.3-codex-high/calculator.html) html: [`001/codex/gpt-5.3-codex-high/calculator.html`](001/codex/gpt-5.3-codex-high/calculator.html)
- `gpt-5.4-high` page: [calculator](https://modelfortytwo.github.io/toy.llm/001/codex/gpt-5.4-high/calculator.html) html: [`001/codex/gpt-5.4-high/calculator.html`](001/codex/gpt-5.4-high/calculator.html)
- `opencode/big-pickle` page: [calculator](https://modelfortytwo.github.io/toy.llm/001/opencode/big_pickle/calculator.html) html: [`001/opencode/big_pickle/calculator.html`](001/opencode/big_pickle/calculator.html)
- `opencode/mimo-v2-flash-free` page: [calculator](https://modelfortytwo.github.io/toy.llm/001/opencode/mimo_v2_flash/calculator.html) html: [`001/opencode/mimo_v2_flash/calculator.html`](001/opencode/mimo_v2_flash/calculator.html)
- `opencode/minimax-m2.5-free` page: [calculator](https://modelfortytwo.github.io/toy.llm/001/opencode/minimax_m2.5/calculator.html) html: [`001/opencode/minimax_m2.5/calculator.html`](001/opencode/minimax_m2.5/calculator.html)

### 002. HTML + js Snake game

**Task** Implement a snake game a classic nokia style snake game using HTML and js into snake.html.

- `gpt-5.1-codex-mini-high` page: [snake](https://modelfortytwo.github.io/toy.llm/002/codex/gpt-5.1-codex-mini-high/snake.html) html: [`002/codex/gpt-5.1-codex-mini-high/snake.html`](002/codex/gpt-5.1-codex-mini-high/snake.html)
- `gpt-5.2-codex-high` page: [snake](https://modelfortytwo.github.io/toy.llm/002/codex/gpt-5.2-codex-high/snake.html) html: [`002/codex/gpt-5.2-codex-high/snake.html`](002/codex/gpt-5.2-codex-high/snake.html)
- `gpt-5.3-codex-high` page: [snake](https://modelfortytwo.github.io/toy.llm/002/codex/gpt-5.3-codex-high/snake.html) html: [`002/codex/gpt-5.3-codex-high/snake.html`](002/codex/gpt-5.3-codex-high/snake.html)
- `gpt-5.4-high` page: [snake](https://modelfortytwo.github.io/toy.llm/002/codex/gpt-5.4-high/snake.html) html: [`002/codex/gpt-5.4-high/snake.html`](002/codex/gpt-5.4-high/snake.html)

### 003. HTML + js Tetris game

### 004. First person shooter using Three.js

**Task** Implement first person shooter game using Three.js int fps.html.

### 005. TODO app with database

**Task** Implement a TODO app which stores data in a mysql database there should be nodejs webserver and html + js frontend.
