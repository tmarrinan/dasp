import math
from PIL import Image

def main():
    filename = 'test_16x8.png'
    
    # open image file
    img = Image.open(filename)

    # get resolution of image
    width, height = img.size
    
    # get array of pixels
    pixels = list(img.getdata())
    
    # calculate hole sizes
    pixel_hole_count = 0
    projected_hole_percent = 0.0
    for i in range(height):
        lat1 = (180.0 * (i / height)) - 90.0
        lat2 = (180.0 * ((i + 1) / height)) - 90.0
        num_black = countBlackPixelsOnRow(height - i - 1, pixels, width)
        pixel_hole_count += num_black
        lon1 = -180.0
        lon2 = 360.0 * (num_black / width) - 180.0
        projected_hole_percent += sphereAreaQuad(lat1, lon1, lat2, lon2)
    pixel_hole_percent = pixel_hole_count / (width * height)
    print(f'img pixel hole area: {100.0 * pixel_hole_percent:.3f}%')
    print(f'projected hole area: {100.0 * projected_hole_percent:.3f}%')

def countBlackPixelsOnRow(row, pixels, width):
    """
    returns the number of black pixels on a specified row of an image
    """
    black_count = 0
    for i in range(width):
        if isBlack(pixels[row * width + i]):
            black_count += 1
    return black_count

def isBlack(pixel):
    """
    returns whether or not a pixel is black
    """
    if pixel[0] == 0 and pixel[1] == 0 and pixel[2] == 0:
        return True
    return False

def sphereAreaQuad(lat1, lon1, lat2, lon2):
    """
    returns the surface area bounded by the parallels lat1 and lat2 and the meridians
    lon1 and lon2. The output area is a fraction of the unit sphere's area of 4π, so
    the result ranges from 0.0 to 1.0.
    """
    if lat2 < lat1:
        tmp = lat1
        lat1 = lat2
        lat2 = tmp
    if lon2 < lon1:
        tmp = lon1
        lon1 = lon2
        lon2 = tmp
    lat1 = math.radians(lat1)
    lon1 = math.radians(lon1)
    lat2 = math.radians(lat2)
    lon2 = math.radians(lon2)
    height = math.sin(lat2) - math.sin(lat1)
    area = height * (lon2 - lon1)
    return area / (4.0 * math.pi)
    
    
main()
