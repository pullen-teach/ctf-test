# Mission 4: Needle in the tree

**Difficulty:** Medium · **200 points**

```
cd ~/mission4
cat README.txt
```{{exec}}

The `archive` folder holds about 80 files in 20 folders. Exactly **one** of them has the file ending named in `README.txt`, and it holds the flag.

Opening folders one by one is too slow. Let the computer search.

**Useful commands:** `find`, `cat`. Use `--help` to discover what they can do.

When you have the flag, record it with `submit` and press **CHECK**.

<br>

<details><summary>Hint</summary>

Read the help for `find` and look for a way to match a file's **name** against a pattern. In a pattern, `*` means "anything".

```
find --help
```

The full manual page has even more: `man find` (press `q` to quit).

</details>
