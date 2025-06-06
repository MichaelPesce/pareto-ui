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
import importlib
from pathlib import Path
import re
import os
import sys

def add_cbc_and_dependencies():
    cbc_datas = []
    if sys.platform == "darwin":
        cbc = "cbc"
    elif sys.platform == "linux":
        cbc = "cbc"
    else:
        cbc = "cbc.exe"
    cbc_datas.append((f"idaes_extensions/{cbc}", "idaes_extensions"))
    
    # add every dynamic link library just to be safe 
    idaes_extensions_directory = "idaes_extensions"
    for file in os.listdir(idaes_extensions_directory):
        if "dll" in file or "dylib" in file:
            filepath = os.path.join(idaes_extensions_directory, file)
            if os.path.isfile(filepath):
                cbc_datas.append((filepath, idaes_extensions_directory))
    print(f"cbc_datas: \n{cbc_datas}")
    return cbc_datas

datas = []

skip_expr = re.compile(r"_test|test_|__")
print('inside hook-pareto.py')

# add all png files to pyinstaller data
pkg = "../../../project-pareto/docs/img"
pkg_path = Path(f'{pkg}')
dst_name = f"docs/img"
src_name = ""
for png_file in pkg_path.glob("**/*.png"):
    file_name = '/' + png_file.as_posix().split('/')[-1]
    print(file_name)
    if skip_expr.search(str(png_file)):
        continue
    relative_path = png_file.relative_to(pkg_path)
    dotted_name = relative_path.as_posix()
    src_name = f"{pkg}/" + dotted_name
    try:
        datas.append((src_name,dst_name))
    except Exception as err:  # assume the import could do bad things
        print(f"Import of file '{png_file}' failed: {err}")
        continue
datas.append((src_name, 'pareto'))


# add data files for default scenario setup
pkg = "internal/assets/v1_default"
pkg_path = Path(f'{pkg}')
for png_file in pkg_path.glob("**/*"):
    file_name = '/' + png_file.as_posix().split('/')[-1]
    relative_path = png_file.relative_to(pkg_path)
    dotted_name = relative_path.as_posix()
    src_name = f"{pkg}/" + dotted_name
    suffix = "/"
    if '/' in dotted_name:
        split_name = dotted_name.split('/')[0:-1]
        for each in split_name:
            suffix = suffix+each
    dst_name = f"app/{pkg}{suffix}"
    if dotted_name != "." and "DS_" not in dotted_name and not os.path.isdir(src_name):
        try:
            datas.append((src_name,dst_name))
        except Exception as err:  # assume the import could do bad things
            print(f"Import of file '{png_file}' failed: {err}")
            continue

# add disposal override pngs
datas.append(('internal/assets/DisposalOverride.png', 'app/internal/assets'))
datas.append(('internal/assets/DisposalOverrideInput.png', 'app/internal/assets'))
datas.append(('internal/assets/SRAInput.png', 'app/internal/assets'))

# add workshop pngs
datas.append(('internal/assets/workshop_baseline_input.png', 'app/internal/assets'))
datas.append(('internal/assets/workshop_baseline_output.png', 'app/internal/assets'))
datas.append(('internal/assets/workshop_SRA_input.png', 'app/internal/assets'))
datas.append(('internal/assets/workshop_SRA_output.png', 'app/internal/assets'))
datas.append(('internal/assets/workshop_beneficial_reuse_input.png', 'app/internal/assets'))
datas.append(('internal/assets/workshop_beneficial_reuse_output.png', 'app/internal/assets'))
datas.append(('internal/assets/workshop_beneficial_reuse_override_input.png', 'app/internal/assets'))
datas.append(('internal/assets/workshop_beneficial_reuse_override_output.png', 'app/internal/assets'))

# add input template
datas.append(('internal/assets/pareto_input_template.xlsx', 'app/internal/assets'))
datas.append(('internal/assets/workshop_baseline_all_data_0.9.0.xlsx', 'app/internal/assets'))

# add lorem ipsum.txt for jaraco
datas.append(('internal/assets/Lorem ipsum.txt', 'jaraco/text'))

cbc_datas = add_cbc_and_dependencies()
datas.extend(cbc_datas)

datas.append((".env", "."))

print(datas)