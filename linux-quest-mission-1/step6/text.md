# Mission 6: Odd one out

**Difficulty:** Medium · **200 points**

**Objective:** Use a pipe to find the only code that appears once.

```
cd ~/mission7
head codes.txt
```{{exec}}

`codes.txt` holds about 900 flags. Every fake one appears **at least twice**. The real flag appears **exactly once**.

Reading 900 lines is no fun. Chain two commands with a **pipe** (`|`): the first one sorts the lines so the copies sit next to each other, the second one finds the line that has no twin.

**Useful commands:** `sort`, `uniq`. Use `--help` to discover what they can do.

When you have the flag, record it with `submit` and press **CHECK**.

<br>

<details><summary>Hint</summary>

`uniq` only compares lines that sit **next to each other**, so `sort` the file first and pipe it into `uniq`. Then read the help for `uniq` and look for the option that prints only the **unique** lines.

```
uniq --help
```

The full manual page has even more: `man uniq` (press `q` to quit).

</details>
