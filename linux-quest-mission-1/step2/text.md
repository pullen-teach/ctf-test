# Mission 2: Let the cat out of the bag

**Difficulty:** Easy · **100 points**

```
cd ~/mission2
cat README.txt
```{{exec}}

`cat` prints a file on the screen. You just used it to read `README.txt`.

The cat is hiding in `bag.txt`: 100 lines, and every one looks like a flag. Only the line number in `README.txt` is real. Counting 100 lines by hand is how mistakes happen.

Almost every Linux command can **explain itself**: type its name, a space, then `--help`. Ask `cat` for its help and look for an option that numbers the lines. You will use `--help` in every mission after this one.

**Useful command:** `cat`.

When you have the flag, record it with `submit` and press **CHECK**.

<br>

<details><summary>Hint</summary>

Read the help for `cat` and look for the option that **numbers** the lines. Options go between the command and the file name.

```
cat --help
```

The full manual page has even more: `man cat` (press `q` to quit).

</details>
