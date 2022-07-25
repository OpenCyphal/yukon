import os
import typing


def setup_sentry(sentry_sdk: typing.Any) -> None:
    if os.environ.get("SENTRY") == "1":
        sentry_sdk.init(
            dsn="https://b594be40049042b0bacfc6a9e0cbfa7e@o86093.ingest.sentry.io/6547831",
            # Set traces_sample_rate to 1.0 to capture 100%
            # of transactions for performance monitoring.
            # We recommend adjusting this value in production.
            traces_sample_rate=1.0,
        )
