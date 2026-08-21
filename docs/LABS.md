# Interactive labs

The main website owns the labs index, pinned source revision, build orchestration, and Pages artifact. `labs-src/cloth-simulation` is an HTTPS Git submodule pointing to the independent `wasm-cloth-lab` repository. Only its compiled frontend is published at `/labs/cloth-simulation/`; its Rust/TypeScript source is not copied into `_site`.

```sh
git submodule update --init --recursive
./scripts/build-site.sh
python3 -m http.server --directory _site 8000
```

The build generates WASM, installs locked frontend dependencies, builds with `VITE_BASE=/labs/cloth-simulation/`, assembles the existing static site, and verifies the nested entry point and root `CNAME`. GitHub Actions performs the same operation and deploys `_site` through the official Pages actions.

To deliberately update the pinned lab revision, run `./scripts/update-cloth-lab.sh`, inspect the result, then commit the changed submodule pointer. Website deployments never pull an uncontrolled newer lab revision.
