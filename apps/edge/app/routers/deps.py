from fastapi import HTTPException
from requests.exceptions import RequestException


def run_action(action):

    try:

        return action()

    except RequestException as error:

        detail = str(error)

        if error.response is not None:
            detail = error.response.text or detail

        raise HTTPException(
            status_code=502,
            detail=detail
        ) from error

    except ValueError as error:

        raise HTTPException(
            status_code=400,
            detail=str(error)
        ) from error
