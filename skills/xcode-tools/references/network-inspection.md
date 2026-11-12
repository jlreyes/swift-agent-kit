# Inspect native Mac requests with Proxyman MCP

Use Proxyman MCP to inspect a native app’s HTTP/HTTPS requests, payloads,
failures and retries without adding an app SDK or custom collector. The app
must use the configured proxy; HTTPS inspection also requires client trust and
an SSL Proxying rule. Replay, response rewriting, WebSockets and
certificate-pinned clients were not established by the native Mac spike.

## 1. Identify the client and the proxy

Proxyman can run on the same Mac as the app, or on a host that serves a VM's
traffic. In the latter case, use the environment's machine-access procedure
for the existing transport, reachable proxy endpoint and forwarding lifetime.
The proxy endpoint is interpreted by the client machine: its loopback is not
the host's loopback.

Before opening Proxyman or changing proxy settings, record the HTTP and HTTPS
proxy server, port, enabled state and bypass list on both the Proxyman host
and the client. If they are the same Mac, record them once. On each macOS
machine, identify the active service rather than assuming a particular name:

```sh
networksetup -listallnetworkservices
networksetup -getwebproxy "$network_service"
networksetup -getsecurewebproxy "$network_service"
networksetup -getproxybypassdomains "$network_service"
```

Set `network_service` to the chosen service before running these examples.
Record Proxyman's recording state, SSL rules and relevant filter state too.
The host's own system proxy is separate from a VM's proxy settings; host-side
capture does not require enabling the host's system proxy.

## 2. Connect to the host's MCP server

Use the official stdio adapter on the Mac running Proxyman:

```text
/Applications/Proxyman.app/Contents/MacOS/mcp-server
```

For a remote host, run that adapter through the existing authenticated
machine transport. No public MCP listener is needed. Discover the live tools
and schemas; the names below describe the tested Proxyman 26.4.0 interface.

Keep a normal Proxyman capture window open. Check both `get_version` and a
request-list operation: version discovery succeeded while traffic tools failed
because no request window was open. In that state, `open_proxyman` reported
that the app was already running without opening the missing window.

If MCP is enabled but stopped, inspect Settings → MCP. During the spike,
`proxyman-cli mcp on` changed the preference while the running server stayed
stopped; toggling the setting off and on started it. App activation can be
slow, so inspect its result before repeating the action.

## 3. Enable capture for the intended traffic

Start recording when needed, retaining the previous state for restoration.
Enable the client proxy using the endpoint selected in step 1. For a macOS
client, the commands are:

```sh
sudo networksetup -setwebproxy "$network_service" "$proxy_host" "$proxy_port"
sudo networksetup -setwebproxystate "$network_service" on
sudo networksetup -setsecurewebproxy "$network_service" "$proxy_host" "$proxy_port"
sudo networksetup -setsecurewebproxystate "$network_service" on
```

Set `proxy_host` and `proxy_port` from the environment's configuration. Check
the actual OS state with `scutil --proxy` and the `networksetup -get…` commands.
An MCP acknowledgement is insufficient: `set_system_proxy(true)` reported
enabled configuration during one test while the OS still had no HTTP proxy.
Opening Proxyman also automatically enabled host proxying and recording during
the spike; compare actual state with the saved settings after activation.

For HTTPS, establish authorized SSL trust for the proxy host's public CA in
the client account, and enable SSL Proxying for the intended API domain.
Transfer only the public certificate, not the host's private key or P12. Compare
certificate fingerprints before installing it. The host's own trust store
does not establish trust in a VM.

Use the normal macOS installation and authorization flow. Even a command run
remotely or with elevated privileges can require interactive confirmation; the
user may need to complete a protected system dialog. Do not disable TLS
validation. Trust installed in a user's trust domain applies to that account;
other accounts are a separate case.

## 4. Read the request that answers the question

Trigger a new action in the app. Filter on the authorized API URL before
retrieving a flow ID. For example, replace the URL prefix below with the
intended endpoint, using the live `filter_flows` schema:

```json
{"key":"url","matching":"startWith","value":"https://api.example.test/todos","limit":30}
```

Take a current flow ID from that result, then use `get_flow_detail` for status,
headers and body information. Use `query_flow_body` when a small JSON answer
is enough: for a created todo, query request `.title` and the corresponding
response value. Read that tool's current schema for request/response selection
and query arguments rather than copying an assumed wrapper prefix.

For a failure/retry workflow, retain both flow IDs and compare the same URL,
status, relevant payload and response. The spike exercised a 503 followed by
200, a POST 201 with matching data, and a destination-offline proxy 502 followed
by successful recovery. A proxy-generated error is not the origin server's
response.

Verify HTTPS with a normal client after OS trust is installed. Native
`URLSession.shared` requests succeeded on all three tested clients using their
normal OS trust stores, without a custom CA delegate. `curl --cacert` also established validated TLS transport,
but its process-specific trust alone did not prove native-app trust.

Avoid full-session exports and broad queries over unrelated host traffic.
A capture window's full accessibility tree can include the selected request's
authorization headers; prefer scoped MCP reads for payload inspection.

## 5. Restore the previous state

Restore the saved HTTP and HTTPS proxy server, port and enabled state on each
changed client before stopping the proxy or an SSH forward. Also restore the
host's saved OS proxy state if opening or using Proxyman changed it. Do not
assume that disabling a proxy alone restores its former address. Re-read the
actual OS configuration on both machines. Remove only a temporary SSL rule
that this task added, and restore recording and filter state without clearing
existing captures.

For host-based VM capture, stop only owned forwarding processes and confirm
their listeners closed. Keep approved client CA trust when ongoing debugging
was authorized; installing trust does not require keeping the proxy enabled.

## Interpretation limits

Host capture can identify a remote VM by IP, or a local SSH process when a
loopback forward is used. It does not preserve the VM app's original PID.
Use known forwarding ownership or controlled request markers for attribution.
Clients that ignore system proxies, non-HTTP protocols and certificate pinning
need separate investigation; these results do not establish their coverage.

The [dated spike record](https://github.com/jlreyes/swift-agent-kit/blob/main/docs/native-mac-tooling-spike-2026-11-12.md)
contains the tested cases. Vendor references: [MCP](https://proxyman.com/docs/mcp),
[macOS capture and certificates](https://proxyman.com/docs/debug-devices/macos),
[command line](https://proxyman.com/docs/command-line).
