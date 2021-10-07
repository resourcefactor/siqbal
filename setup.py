from setuptools import setup, find_packages

with open('requirements.txt') as f:
	install_requires = f.read().strip().split('\n')

# get version from __version__ variable in siqbal/__init__.py
from siqbal import __version__ as version

setup(
	name='siqbal',
	version=version,
	description='Tiles Comapany',
	author='RF',
	author_email='hamza@rf.com',
	packages=find_packages(),
	zip_safe=False,
	include_package_data=True,
	install_requires=install_requires
)
