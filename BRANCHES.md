# Teachwise — Branch Strategy

## Branch Structure

| Branch    | Purpose                        | Deploys To                        |
|-----------|--------------------------------|-----------------------------------|
| main      | Production code                | teachwiseedu.com                  |
| staging   | Pre-production testing         | staging.teachwiseedu.com          |
| dev       | Active development             | localhost:3000                    |
| legacy    | Old Jinja2 app (archived)      | Never deploy                      |

## Workflow
```
feature work → dev → staging → main → production
```

### Step by step

1. Do all work on `dev` branch locally
2. When a feature is ready — push dev to GitHub
3. Create PR: dev → staging
4. Deploy staging and run smoke tests
5. If all tests pass — create PR: staging → main
6. Merge to main — auto-deploys to production

## Commands

### Start working
```bash
git checkout dev
git pull origin dev
```

### Save your work
```bash
git add .
git commit -m "feat: description of what you built"
git push origin dev
```

### Promote to staging
```bash
# On GitHub — create PR from dev into staging
# Squash and merge
# Staging server auto-deploys
```

### Promote to production
```bash
# On GitHub — create PR from staging into main
# Squash and merge
# Vercel and Railway auto-deploy
```

## Commit Message Format
```
feat: add new feature
fix: fix a bug
style: UI/CSS changes only
refactor: code change with no feature change
docs: documentation only
chore: dependency updates, config changes
```

## Rules

- Never commit directly to main
- Never commit directly to staging
- Always work on dev
- Always test on staging before merging to main
- Never delete the legacy branch
