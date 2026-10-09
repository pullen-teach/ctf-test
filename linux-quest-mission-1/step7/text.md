# Mission 7: Permission denied

**Difficulty:** Medium · **200 points**

**Objective:** Unlock a script with chmod and run it.

```
cd ~/mission8
ls -l
```{{exec}}

The flag is behind a locked door: `unlock.sh`. It is a **script**, a file full of commands that runs when you type `./unlock.sh`.

Try it, and Linux will refuse. `ls -l` shows why: the letters at the start of each line are the file's **permissions**. `r` means read, `w` means write and `x` means execute (run). This script has no `x`.

You own the file, so you are allowed to change its permissions.

**Useful commands:** `ls`, `chmod`. Use `--help` to discover what they can do.

When you have the flag, record it with `submit` and press **CHECK**.

<br>

<details><summary>Hint</summary>

Read the help for `chmod`. You want to **add** (`+`) the e**x**ecute permission (`x`) to `unlock.sh`, then run `./unlock.sh` again.

```
chmod --help
```

The full manual page has even more: `man chmod` (press `q` to quit).

</details>
