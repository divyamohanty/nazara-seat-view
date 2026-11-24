#!/bin/sh
# Build the site and publish dist/ to the gh-pages branch of origin.
set -e
npm run build
remote=$(git remote get-url origin)
name=$(git config user.name)
email=$(git config user.email)
cd dist
rm -rf .git
git init -q -b gh-pages
git add -A
git -c user.name="$name" -c user.email="$email" commit -q -m "Deploy $(date -u +%Y-%m-%dT%H:%MZ)"
git push -q -f "$remote" gh-pages
rm -rf .git
echo "Published to gh-pages."
