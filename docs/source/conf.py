# Configuration file for the Sphinx documentation builder.
#
# This file only contains a selection of the most common options. For a full
# list see the documentation:
# https://www.sphinx-doc.org/en/master/usage/configuration.html

# -- Path setup --------------------------------------------------------------

# If extensions (or modules to document with autodoc) are in another directory,
# add these directories to sys.path here. If the directory is relative to the
# documentation root, use os.path.abspath to make it absolute, like shown here.
#
# import os
# import sys
# sys.path.insert(0, os.path.abspath('.'))


# -- Project information -----------------------------------------------------

project = 'Beamer Bridge'
copyright = '2022, brainbot technologies AG'
author = 'brainbot technologies AG'

# The full version, including alpha/beta/rc tags
release = '0.1'


# -- General configuration ---------------------------------------------------

# Add any Sphinx extension module names here, as strings. They can be
# extensions coming with Sphinx (named 'sphinx.ext.*') or your custom
# ones.
extensions = [
    'sphinx.ext.autodoc',
    'sphinx.ext.graphviz',
    'sphinx.ext.todo',
    'sphinxcontrib.mermaid',
    'sphinxcontrib.soliditydomain'
]

autodoc_default_options = { 'members': None, 'exclude-members': '<private>' }

# Add any paths that contain templates here, relative to this directory.
templates_path = ['_templates']

# List of patterns, relative to source directory, that match files and
# directories to ignore when looking for source files.
# This pattern also affects html_static_path and html_extra_path.
exclude_patterns = []


# -- Options for HTML output -------------------------------------------------

# The theme to use for HTML and HTML Help pages.  See the documentation for
# a list of builtin themes.
#
html_theme = 'furo'

html_theme_options = {
    'light_css_variables': {
        'color-foreground-primary': '#001B23',
        'color-foreground-secondary': '#001B23',
        'color-background-primary': '#F7FFFC',
        'color-background-secondary': '#F7FFFC',
        'color-brand-primary': '#005E63',
        'color-brand-content': '#005E63',
        'font-stack': 'Sora, sans-serif',
        'font-stack--monospace': 'Courier, monospace',
    },
    'dark_css_variables': {
        'color-foreground-primary': '#F7FFFC',
        'color-foreground-secondary': '#F7FFFC',
        'color-background-primary': '#001B23',
        'color-background-secondary': '#001B23',
        'color-brand-primary': '#05B0AB',
        'color-brand-content': '#05B0AB',
        'font-stack': 'Sora, sans-serif',
        'font-stack--monospace': 'Courier, monospace',
    },
    "light_logo": "logo.png",
    "dark_logo": "logo-white.png",
}

# Add any paths that contain custom static files (such as style sheets) here,
# relative to this directory. They are copied after the builtin static files,
# so a file named "default.css" will overwrite the builtin "default.css".
html_static_path = ['_static']

html_css_files = [
    'css/styles.css',
]
html_favicon = 'favicon.png'

html_title = f'Beamer documentation'

html_permalinks = False
html_show_sphinx = False
todo_include_todos = True
