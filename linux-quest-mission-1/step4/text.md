# Mission 4: Search party

```
cd ~/mission4
cat README.txt
```{{exec}}

`access.log` has 40,000 lines. One intruder logged in exactly once.
Their **token** on that line is the flag. Scrolling would take all day.

**Useful commands:** `grep`, plus `head` and `wc` to explore the log. Use `--help` to discover what they can do.

<br>

<details><summary>Hint</summary>

Read the help for `grep` and look for the **Usage** line at the top: it shows what goes first and what goes second.:

```
grep --help
```

The full manual page has even more: `man grep` (press `q` to quit).

</details>
