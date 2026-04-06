# Changesets

This project uses [changesets](https://github.com/changesets/changesets) for version management and publishing.

## Creating a changeset

After making changes, run:

```bash
pnpm changeset
```

Select the packages that changed and describe the change.

## Versioning and publishing

```bash
pnpm changeset version   # Update package versions based on changesets
pnpm changeset publish    # Publish changed packages to npm
```

These are run automatically by CI on the `main` branch.
