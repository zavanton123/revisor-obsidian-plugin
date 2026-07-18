#!/usr/bin/env bash
# Requires: gh auth login (repo admin)
set -euo pipefail

REPO="${1:-zavanton123/revisor-obsidian-plugin}"
BRANCH="${2:-master}"

echo "Configuring branch protection on ${REPO}@${BRANCH}..."

gh api \
  --method PUT \
  -H "Accept: application/vnd.github+json" \
  "repos/${REPO}/branches/${BRANCH}/protection" \
  --input - <<'EOF'
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["CI"]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "required_approving_review_count": 0,
    "dismiss_stale_reviews": true
  },
  "restrictions": null,
  "required_linear_history": false,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "block_creations": false
}
EOF

echo "Done. PRs into ${BRANCH} must pass the aggregate \"CI\" check before merge."
echo "Note: enable \"Require status checks to pass\" in GitHub Settings if the API call is rejected for a free private repo."
