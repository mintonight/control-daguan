"""Browser-test synchronization. idle observes app work; assertions observe browser/SW state."""
import asyncio


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
