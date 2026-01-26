# Dev workflow (Cursor + Railway)

## Daily work (staging)
git checkout dev
git pull
npm run dev

# after changes
git status
git add .
git commit -m "Short description"
git push

## Promote to production
git checkout main
git pull
git merge dev
git push

## If you need to go back
git checkout dev
