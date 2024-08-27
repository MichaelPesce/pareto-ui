import os
import sys
import sphinx_rtd_theme

sys.path.insert(0, os.path.abspath(".."))

# -- Project information -----------------------------------------------------

project = "PARETO UI"
# copyright = ""
# author = ""

release = "1.0.0"
version = "1.0.0"
# -- General configuration ---------------------------------------------------

# Add any Sphinx extension module names here, as strings. They can be
# extensions coming with Sphinx (named 'sphinx.ext.*') or your custom
# ones.
extensions = [
    "sphinx_rtd_theme",
    "sphinx.ext.autodoc",
    "sphinx.ext.intersphinx",
    "sphinx.ext.coverage",
    "sphinx.ext.mathjax",
    "sphinx.ext.ifconfig",
    "sphinx.ext.viewcode",
    "sphinx.ext.githubpages",
    "sphinx.ext.autosectionlabel",
    "sphinx.ext.doctest",
]

mathjax3_config = {"chtml": {"displayAlign": "left", "displayIndent": "2em"}}

autosectionlabel_prefix_document = True
autodoc_warningiserror = False  # suppress warnings during autodoc

# Add any paths that contain templates here, relative to this directory.
# templates_path = ["_templates"]

# List of patterns, relative to source directory, that match files and
# directories to ignore when looking for source files.
# This pattern also affects html_static_path and html_extra_path.
exclude_patterns = ["_build", "Thumbs.db", ".DS_Store", "apidoc/*tests*"]

# -- Options for HTML output -------------------------------------------------

# The theme to use for HTML and HTML Help pages.  See the documentation for
# a list of builtin themes.
#
html_theme = "sphinx_rtd_theme"

# Add any paths that contain custom static files (such as style sheets) here,
# relative to this directory. They are copied after the builtin static files,
# so a file named "default.css" will overwrite the builtin "default.css".
html_static_path = ["_static"]
html_css_files = ["custom.css"]

# The name of an image file (relative to this directory) to place at the top
# of the sidebar.
#
# html_logo = "_static/NAWI_logo.png"

# The name of an image file (relative to this directory) to use as a favicon of
# the docs.  This file should be a Windows icon file (.ico) being 16x16 or 32x32
# pixels large.
#
html_favicon = "_static/favicon.ico"

# intersphinx mapping to idaes
intersphinx_mapping = {
    "pareto": ("https://idaes-pse.readthedocs.io/en/stable/", None),
    "parameter_sweep": ("https://parameter-sweep.readthedocs.io/en/latest/", None),
}

rst_epilog = """
.. |Binder launch button| image:: https://mybinder.org/badge_logo.svg
   :target: https://mybinder.org/v2/gh/watertap-org/watertap/main?labpath=tutorials%2F00-index.ipynb
"""
