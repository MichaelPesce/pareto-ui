#####################################################################################################
# PARETO was produced under the DOE Produced Water Application for Beneficial Reuse Environmental
# Impact and Treatment Optimization (PARETO), and is copyright (c) 2021-2024 by the software owners:
# The Regents of the University of California, through Lawrence Berkeley National Laboratory, et al.
# All rights reserved.
#
# NOTICE. This Software was developed under funding from the U.S. Department of Energy and the U.S.
# Government consequently retains certain rights. As such, the U.S. Government has been granted for
# itself and others acting on its behalf a paid-up, nonexclusive, irrevocable, worldwide license in
# the Software to reproduce, distribute copies to the public, prepare derivative works, and perform
# publicly and display publicly, and to permit others to do so.
#####################################################################################################
import sys
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import multiprocessing
from dotenv import load_dotenv

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.append(os.path.dirname(SCRIPT_DIR))

from app.internal.get_extensions import check_for_idaes_extensions, get_idaes_extensions
from app.routers import scenarios, ai_settings
import idaes.logger as idaeslog

_log = idaeslog.getLogger(__name__)

## load environment differently depending on mode (prod or dev)
def get_base_dir():
    if getattr(sys, 'frozen', False):
        # PyInstaller bundle:
        return os.path.dirname(sys.executable)
    else:
        return os.path.dirname(os.path.abspath(__file__))

base_dir = get_base_dir()
dotenv_path = os.path.join(base_dir, ".env")
_log.info(f"checking for .env in {dotenv_path}")
load_dotenv(dotenv_path)


# add pareto idaes_extensions path, remove idaes default path
is_prod = os.environ.get("production", None)
if is_prod:
    _log.info(f"PRODUCTION: using custom path for solver executables (cbc)")
    idaes_extensions_path = f"{SCRIPT_DIR}/idaes_extensions"
    os.environ["PATH"] = idaes_extensions_path + os.pathsep + os.environ["PATH"]
    original_path = os.environ["PATH"]
    paths = original_path.split(os.pathsep)
    filtered_paths = [p for p in paths if "idaes/bin" not in p]
    os.environ["PATH"] = os.pathsep.join(filtered_paths)
else:
    _log.info(f"rolling with default solvers path: {is_prod}")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(scenarios.router)
app.include_router(ai_settings.router)

def getPort():
    port = 50011
    # s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    # foundOpenPort = False
    # while not foundOpenPort:
    #     try:
    #         s.bind(("127.0.0.1", port))
    #         _log.info(f"found open port: {port}")
    #         foundOpenPort = True
    #     except socket.error as e:
    #         if e.errno == errno.EADDRINUSE:
    #             _log.info(f"Port {port} is already in use")
    #         else:
    #             _log.error(f"Error while trying to connect to port {port}: {e}")
    #         port += 1
    # s.close()
    return port

if __name__ == '__main__':
    port = getPort()
    if('i' in sys.argv or 'install' in sys.argv):
        _log.info('running get_extensions()')
        if not check_for_idaes_extensions():
            get_idaes_extensions()

    elif('d' in sys.argv or 'dev' in sys.argv):
        _log.info(f"starting app in dev")
        multiprocessing.freeze_support()
        uvicorn.run("__main__:app", host="127.0.0.1", port=port, reload=True)

    else:
        _log.info(f"starting app")
        multiprocessing.freeze_support()
        uvicorn.run(app, host="127.0.0.1", port=port, reload=False)
