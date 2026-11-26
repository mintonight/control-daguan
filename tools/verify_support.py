"""Browser-test synchronization. idle observes app work; assertions observe browser/SW state."""
import asyncio
import os


async def launch_chromium(pw, **kwargs):
    """Launch Chrome on CI/Linux or fall back to local Chrome/Edge/Chromium on other platforms."""
    if os.path.exists('/usr/bin/google-chrome'):
        return await pw.chromium.launch(executable_path='/usr/bin/google-chrome', **kwargs)
    for opt in ({'channel': 'chrome'}, {'channel': 'msedge'}, {}):
        try:
            return await pw.chromium.launch(**opt, **kwargs)
        except Exception:
            continue
    return await pw.chromium.launch(**kwargs)


async def launch_persistent_chromium(pw, user_data_dir, **kwargs):
    """Launch persistent Chromium profile across Linux/CI, Windows and macOS."""
    if os.path.exists('/usr/bin/google-chrome'):
        return await pw.chromium.launch_persistent_context(user_data_dir, executable_path='/usr/bin/google-chrome', **kwargs)
    for opt in ({'channel': 'chrome'}, {'channel': 'msedge'}, {}):
        try:
            return await pw.chromium.launch_persistent_context(user_data_dir, **opt, **kwargs)
        except Exception:
            continue
    return await pw.chromium.launch_persistent_context(user_data_dir, **kwargs)


async def idle(page, *, allow_failure=False, timeout=15):
    """Never flush app work or advance its clock. Bound hangs with a Python deadline.

    Failure is allowed only in scenarios that intentionally exercise failed sync/storage.
    The caller still asserts the specific user-visible error.
    """
    await page.wait_for_function("typeof window.__cdg?.idle === 'function'", timeout=timeout * 1000)
    failure = await asyncio.wait_for(page.evaluate("""() => window.__cdg.idle().then(
      () => null,
      error => ({message: String(error), causes: [...(error.errors || [])].map(String)})
    )"""), timeout=timeout)
    if failure and not allow_failure:
        raise AssertionError(f"Application did not settle successfully: {failure}")
    return failure
