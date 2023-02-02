import asyncio
import logging
from typing import Optional
import os
from pathlib import Path

logger = logging.getLogger(__name__)


def run_application(is_headless: bool, port: Optional[int] = None, should_look_at_arguments: bool = True) -> None:
    try:

        def validate_and_fix_cyphal_path() -> None:
            # Iterate over the entries in the CYPHAL_PATH environment variable and remove any that don't exist
            for path in os.environ.get("CYPHAL_PATH", "").split(os.pathsep):
                if not Path(path).exists():
                    logger.debug("Removing non-existent path %r from CYPHAL_PATH", path)
                    separated_paths = os.environ.get("CYPHAL_PATH", "").split(os.pathsep)
                    separated_paths.remove(path)
                    os.environ["CYPHAL_PATH"] = os.pathsep.join(separated_paths)

        validate_and_fix_cyphal_path()
        from yukon.main import main

        logging.basicConfig(level=logging.DEBUG)
        asyncio.run(
            main(is_headless, port, should_look_at_arguments), debug=True
        )  # pylint: disable=no-value-for-parameter
    except KeyboardInterrupt:
        print("Yukon is closing.")
    except Exception as e:
        print("Failure in Yukon: " + str(e))
        try:
            import pyi_splash

            pyi_splash.close()
        except ImportError:
            pass
        raise


if __name__ == "__main__":
    run_application(False)
