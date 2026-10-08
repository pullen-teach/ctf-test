# Mission 2: Needle in the tree

```
cd ~/mission2
cat README.txt
```{{exec}}

The `archive` folder holds about 80 files in 20 folders.
Exactly **one** of them has the file ending named in `README.txt`, and it holds the flag.

Opening folders one by one is too slow. Let the computer search.

<br>

<details><summary>Hint</summary>

`find archive -name "*.txt"` finds every file ending in `.txt`. Change the ending to the one in the README.

</details>

<details><summary>Solution</summary>

```
find archive -name "*.<ending from README>"
cat <the path find printed>
```

</details>
