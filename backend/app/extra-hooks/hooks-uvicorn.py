from PyInstaller.utils.hooks import collect_submodules, get_package_paths

hiddenimports = collect_submodules('uvicorn')
# datas = [(get_package_paths('uvicorn')[1], 'uvicorn')]