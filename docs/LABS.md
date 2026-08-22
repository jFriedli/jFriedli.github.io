# Interactive labs

The main website owns the labs index, pinned source revisions, build orchestration, and Pages artifact. Standalone lab repositories are connected as public HTTPS Git submodules under `labs-src/`: `cloth-simulation` points to `wasm-cloth-lab`, `fluid-simulation` points to `wasm-fluid-lab`, `path-tracing` points to `wasm-path-tracing-lab`, and `open-ebus-lab` points to `open-ebus-lab`. Only compiled frontends are published under `/labs/<project>/`; Rust, TypeScript, verification tooling, and mission source files outside the bounded derived asset are not copied into `_site`.

```sh
git submodule update --init --recursive
./scripts/build-site.sh
python3 -m http.server --directory _site 8000
```

The build generates WASM, installs locked frontend dependencies, and supplies each project's base-path setting (`VITE_BASE=/labs/cloth-simulation/`, `VITE_BASE_PATH=/labs/fluid-simulation/`, `VITE_BASE_PATH=/labs/path-tracing/`, or Open eBus Lab's `make build-labs`). Open eBus Lab additionally runs its independent Python DBC and CAN serializer verification before Angular is built; Python is build tooling and is absent from the deployed artifact. The script assembles the existing static site, verifies the nested entry points and root `CNAME`, and rejects standalone/source or backend endpoint paths in generated lab assets. GitHub Actions performs the same operation and deploys `_site` through the official Pages actions.

To add another lab, add its public repository as an HTTPS submodule below `labs-src/`, extend `scripts/build-site.sh` with its documented build command and nested base path, copy its static output to `_site/labs/<project>/`, and add a matching card to `labs/index.html`. Website deployments never pull uncontrolled newer lab revisions; submodule commits are deliberately pinned. Use the corresponding `scripts/update-*-lab.sh` helper to update an existing pin deliberately, rebuild, and review it before committing.
